export function getPreviousDayFormatted(dateStr: string) {
  let date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    date = new Date(Date.parse(dateStr));
  }

  date.setDate(date.getDate() - 1);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
  });

  return `${weekday} ${day}.${month}.${year}`;
}