export interface OpcionesSemaforo {
  /** Trabajos simultáneos permitidos. */
  maximo: number;
  /** Cuánto espera un trabajo un lugar antes de desistir. */
  esperaMaxMs: number;
}

type Liberar = () => void;

/**
 * Acota cuántas tareas caras (limpiezas de archivos) corren a la vez. Quien no alcanza lugar
 * espera un tiempo acotado y, si no se libera ninguno, recibe `null` para responder 503.
 */
export class Semaforo {
  private enUso = 0;
  private readonly cola: ((liberar: Liberar | null) => void)[] = [];

  constructor(private readonly opciones: OpcionesSemaforo) {}

  get ocupados(): number {
    return this.enUso;
  }

  adquirir(): Promise<Liberar | null> {
    if (this.enUso < this.opciones.maximo) {
      this.enUso += 1;
      return Promise.resolve(this.liberador());
    }
    return new Promise((resolver) => {
      const entrega = (liberar: Liberar | null): void => {
        clearTimeout(temporizador);
        resolver(liberar);
      };
      const temporizador = setTimeout(() => {
        const posicion = this.cola.indexOf(entrega);
        if (posicion >= 0) this.cola.splice(posicion, 1);
        resolver(null);
      }, this.opciones.esperaMaxMs);
      this.cola.push(entrega);
    });
  }

  private liberador(): Liberar {
    let liberado = false;
    return () => {
      if (liberado) return;
      liberado = true;
      const siguiente = this.cola.shift();
      if (siguiente) siguiente(this.liberador());
      else this.enUso -= 1;
    };
  }
}
