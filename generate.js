import fs from "fs";
import fetch from "node-fetch";

const BASE_API = "https://apis.wavve.com/live/epgs/channels";
const DAYS = 2;
const LIMIT = 200;
const TZ = "+0900";

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

function toXMLTime(str) {
  const d = new Date(str.replace(/-/g, "/"));
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00 " + TZ
  );
}

async function fetchEPG(start, end, offset) {
  const url =
    `${BASE_API}?startdatetime=${encodeURIComponent(start)}` +
    `&enddatetime=${encodeURIComponent(end)}` +
    `&offset=${offset}&limit=${LIMIT}&orderby=old`;

  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  return res.json();
}

async function main() {
  const channels = {};
  const programs = [];
  const now = new Date();

  for (let d = 0; d < DAYS; d++) {
    const day = new Date(now.getTime() + d * 86400000);

    for (let h = 0; h < 24; h++) {
      const start =
        `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())} ${pad(h)}:00`;
      const end =
        `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())} ${pad(h + 1)}:00`;

      let offset = 0;
      while (true) {
        const data = await fetchEPG(start, end, offset);
        const list = data.list || [];
        if (!list.length) break;

        list.forEach(p => {
          if (!channels[p.channelid]) {
            channels[p.channelid] = {
              id: p.channelid,
              name: p.channelname,
              logo: p.image || ""
            };
          }

          programs.push({
            channel: p.channelid,
            start: toXMLTime(p.starttime),
            stop: toXMLTime(p.endtime),
            title: p.title || ""
          });
        });

        if (list.length < LIMIT) break;
        offset += LIMIT;
      }
    }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<tv generator-info-name="wavve-epg">\n`;

  Object.values(channels).forEach(c => {
    xml += `  <channel id="${c.id}">\n`;
    xml += `    <display-name lang="ko">${c.name}</display-name>\n`;
    if (c.logo) xml += `    <icon src="${c.logo}" />\n`;
    xml += `  </channel>\n`;
  });

  programs.forEach(p => {
    xml += `  <programme start="${p.start}" stop="${p.stop}" channel="${p.channel}">\n`;
    xml += `    <title lang="ko">${p.title}</title>\n`;
    xml += `  </programme>\n`;
  });

  xml += `</tv>\n`;

  fs.writeFileSync("wavve.xml", xml);
  console.log("EPG generated:", programs.length);
}

main();