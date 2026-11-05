/** Validaciones numéricas y de fecha que usan las reglas de detección. */

export const soloDigitos = (texto: string) => texto.replace(/\D/g, "");

/** Algoritmo de Luhn: tarjetas bancarias y Número de Seguridad Social. */
export const pasaLuhn = (digitos: string): boolean => {
  let suma = 0;
  let duplicar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let valor = digitos.charCodeAt(i) - 48;
    if (duplicar) {
      valor *= 2;
      if (valor > 9) valor -= 9;
    }
    suma += valor;
    duplicar = !duplicar;
  }
  return suma % 10 === 0;
};

/** Dígito de control de la CLABE: pesos 3, 7, 1 sobre los primeros 17 dígitos. */
export const clabeValida = (digitos: string): boolean => {
  if (digitos.length !== 18) return false;
  const pesos = [3, 7, 1];
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += ((digitos.charCodeAt(i) - 48) * pesos[i % 3]) % 10;
  return (10 - (suma % 10)) % 10 === digitos.charCodeAt(17) - 48;
};

export const fechaValida = (anio: number, mes: number, dia: number): boolean => {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= new Date(Date.UTC(anio, mes, 0)).getUTCDate();
};

/** Fecha AAMMDD de CURP y RFC. El siglo es ambiguo: basta con que exista en alguno. */
export const fechaCortaValida = (aammdd: string): boolean => {
  const aa = Number(aammdd.slice(0, 2));
  const mm = Number(aammdd.slice(2, 4));
  const dd = Number(aammdd.slice(4, 6));
  return fechaValida(1900 + aa, mm, dd) || fechaValida(2000 + aa, mm, dd);
};

export const digitosRepetidos = (digitos: string) => /^(\d)\1+$/.test(digitos);
