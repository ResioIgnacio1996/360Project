const redondear=(value,decimales=4)=>Number(Number(value).toFixed(decimales));
function calcularLinea({avance,anterior,actual=avance,precio,motivo=''}){
  avance=redondear(avance||0,3);anterior=redondear(anterior||0,3);actual=redondear(actual,3);precio=redondear(precio||0,4);
  if(!Number.isFinite(actual)||actual<anterior||actual>100){const e=new Error('El porcentaje debe estar entre el anterior y 100');e.status=422;throw e;}
  const manual=actual!==avance;if(manual&&!String(motivo).trim()){const e=new Error('La modificacion manual requiere motivo');e.status=422;throw e;}
  if(String(motivo).trim().length>500){const e=new Error('El motivo no puede superar 500 caracteres');e.status=422;throw e;}
  const delta=redondear(actual-anterior,3);return {avance,anterior,actual,precio,delta,importe:redondear(precio*delta/100,4),manual,motivo:manual?String(motivo).trim():null};
}
module.exports={redondear,calcularLinea};
