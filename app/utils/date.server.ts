export function formatTrelloDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
  });

  return `${weekday} ${day}.${month}.${year}`;
}

export function getPreviousDayFormatted(dateStr: string) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  return formatTrelloDate(date);
}

export function getTodayFormatted() {
  return formatTrelloDate(new Date());
}

export function getNextDayFormatted(dateStr: string) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
}