export const eventBytes=event=>new TextEncoder().encode(JSON.stringify(event)).byteLength;
export function formatEventSize(bytes,locale='ja'){const number=n=>new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n);return bytes<1024?`${bytes} B`:bytes<1024**2?`${number(bytes/1024)} KB`:`${number(bytes/1024**2)} MB`}
