const MONTHS = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseRange(str) {
  const match = str.match(/(\d+)\s+(\w+)\s*-\s*(\d+)\s+(\w+)/);
  if (!match) return { start: null, end: null };

  const [, d1, m1, d2, m2] = match;
  const year = new Date().getFullYear();

  const start = new Date(year, MONTHS[m1], +d1);
  const end = new Date(year, MONTHS[m2], +d2);

  return {
    start: toYMD(start),
    end: toYMD(end),
  };
}

const groups = Array.from(
  document.querySelectorAll("app-guest-management-group-search-by-region-card"),
).map((card) => {
  const code = card.querySelector("a.card__header-link").innerHTML.trim();
  const columns = Array.from(card.querySelectorAll(".data__pair .data__value"));
  const disponibility = columns.at(1).querySelector("ptrn-translate").innerHTML;
  const cars = columns.at(2).querySelector("span").innerHTML;
  const { start, end } = parseRange(disponibility);
  const region = columns.at(3).querySelector("span").innerHTML;
  return { code, available_from: start, available_to: end, region, cars };
});

/*
const groups = Array.from(
  document.querySelectorAll("app-guest-management-group-search-card"),
).map((card) => {
  const code = card.querySelector("a.card__header-link").innerHTML.trim();
  const columns = Array.from(card.querySelectorAll("ptrn-card-main .data__pair .data__value"));
  const type = columns.at(2).innerHTML;
  return { code, type };
});
*/

let csvContent = "data:text/csv;charset=utf-8,";

groups.forEach((item) => {
  let row = Object.values(item).join(",");
  csvContent += row + "\r\n";
});

var encodedUri = encodeURI(csvContent);
var link = document.createElement("a");
link.setAttribute("href", encodedUri);
link.setAttribute("download", "my_data.csv");
document.body.appendChild(link); // Required for FF

link.click();
