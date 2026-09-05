import { randomBytes, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto';
export function encryptToken(token,key,context) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);
  cipher.setAAD(Buffer.from(context));
  const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),data].map(value=>value.toString('base64')).join('.');
}
export function decryptToken(value,key,context) {
  const [iv,tag,data]=value.split('.').map(value=>Buffer.from(value,'base64'));
  const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);cipher.setAAD(Buffer.from(context));cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');
}
export function validSignature(body,signature,secret) {
  if(!/^sha256=[a-f0-9]{64}$/.test(signature||''))return false;
  return timingSafeEqual(createHmac('sha256',secret).update(body).digest(),Buffer.from(signature.slice(7),'hex'));
}
