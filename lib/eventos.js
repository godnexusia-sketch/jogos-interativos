// Converte os eventos do tiktok-live-connector v2 (protobuf cru do TikTok) no formato das telas.

// Escolhe a melhor URL da foto. O conector v2 entrega o protobuf cru do TikTok (avatarThumb.urlList);
// o formato antigo (profilePicture.url) fica como reserva. HEIC não abre no navegador, então vai por último.
export function picUrls(u) {
  const lists = [u?.avatarThumb?.urlList, u?.avatarMedium?.urlList, u?.avatarLarge?.urlList, u?.profilePicture?.url, u?.profilePicture?.urls];
  // Variações de nome conforme a versão (url_list, urls, avatar_thumb…): pega qualquer link https dentro dos campos de foto
  const deep = (o, out, depth = 0) => { if (!o || depth > 3) return out; if (typeof o === 'string') { if (/^https:\/\//.test(o)) out.push(o); } else if (Array.isArray(o)) o.forEach((x) => deep(x, out, depth + 1)); else if (typeof o === 'object') Object.values(o).forEach((x) => deep(x, out, depth + 1)); return out; };
  for (const [k, v] of Object.entries(u || {})) if (/avatar|profile_?pic/i.test(k)) lists.push(deep(v, []));
  const all = [...new Set(lists.flat().filter((x) => typeof x === 'string' && /^https:\/\//.test(x)))];
  const heic = (x) => /\.heic(\?|$)/i.test(x);
  return [...all.filter((x) => !heic(x)), ...all.filter(heic)].slice(0, 4);
}

export function userInfo(u, d) {
  const idt = d?.userIdentity || {};
  const handle = u?.displayId || u?.uniqueId || '';
  const pics = picUrls(u);
  return {
    // id estável: o número da conta (não muda se a pessoa trocar o @ ou o apelido).
    id: String(u?.id || u?.userId || handle || ''),
    handle,
    nick: u?.nickname || handle || 'anônimo',
    pic: pics[0] || '',
    pics,
    fol: Boolean(idt.isFollowerOfAnchor || idt.isMutualFollowingWithAnchor || Number(u?.followInfo?.followStatus) > 0),
    mod: Boolean(idt.isModeratorOfAnchor),
    sub: Boolean(idt.isSubscriberOfAnchor),
    fan: Boolean(u?.fansClub?.data?.level || u?.fansClub?.level),
  };
}

// Presente no formato v2 (d.gift) com reserva no antigo (d.giftDetails). null = sequência ainda não terminou.
export function giftInfo(d) {
  const g = d.gift || d.giftDetails || {};
  const ext = d.extendedGiftInfo || {};
  // Presentes em sequência (tipo 1) só contam quando a sequência termina.
  if ((g.type ?? g.giftType) === 1 && !d.repeatEnd) return null;
  return {
    giftId: String(d.giftId || g.id || ''),
    img: g.image?.urlList?.[0] || g.icon?.urlList?.[0] || g.giftImage?.url?.[0] || ext.image?.url_list?.[0] || '',
    name: g.name || g.giftName || ext.name || 'Presente',
    count: Number(d.repeatCount) || 1,
    diamonds: Number(g.diamondCount || ext.diamond_count) || 1,
  };
}
