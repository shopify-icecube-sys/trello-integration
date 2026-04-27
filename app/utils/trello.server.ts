const BASE_URL = "https://api.trello.com/1";

const key = process.env.TRELLO_API_KEY!;
const token = process.env.TRELLO_API_TOKEN!;
const boardId = process.env.TRELLO_BOARD_ID!;

export async function getLists() {
  const res = await fetch(
    `${BASE_URL}/boards/${boardId}/lists?key=${key}&token=${token}`
  );
  return res.json();
}

let fullBoardIdCache: string | null = null;

async function getFullBoardId() {
  if (fullBoardIdCache) return fullBoardIdCache;
  if (boardId.length === 24) {
    fullBoardIdCache = boardId;
    return boardId;
  }

  console.log("🔍 Resolving Long Board ID for:", boardId);
  const res = await fetch(`${BASE_URL}/boards/${boardId}?key=${key}&token=${token}`);
  const data = await res.json();
  fullBoardIdCache = data.id;
  return data.id;
}

export async function createList(name: string) {
  if (!boardId) throw new Error("TRELLO_BOARD_ID is missing in .env");
  if (!name) throw new Error("List name is missing");

  const longBoardId = await getFullBoardId();
  console.log(`🛠️ Attempting to create Trello list: "${name}" on board: ${longBoardId}`);

  const res = await fetch(
    `${BASE_URL}/lists?name=${encodeURIComponent(
      name
    )}&idBoard=${longBoardId}&pos=bottom&key=${key}&token=${token}`,
    { method: "POST" }
  );



  if (!res.ok) {
    const text = await res.text();
    console.error("❌ TRELLO CREATE LIST ERROR:", text);
    throw new Error(`Trello API Error: ${text}`);
  }

  return res.json();
}

export async function getOrCreateList(name: string) {
  const lists = await getLists();

  if (!Array.isArray(lists)) {
    console.error("❌ getLists did not return an array:", lists);
    throw new Error("Failed to fetch Trello lists");
  }

  let list = lists.find((l: any) => l.name === name);

  if (!list) {
    list = await createList(name);
  }

  return list.id;
}


export async function createCard(listId: string, name: string, desc: string = "") {
  const res = await fetch(
    `https://api.trello.com/1/cards?name=${encodeURIComponent(
      name
    )}&desc=${encodeURIComponent(desc)}&idList=${listId}&key=${key}&token=${token}`,
    { method: "POST" }
  );

  const data = await res.json();
  return data;
}

export async function updateCard(cardId: string, updates: { name?: string, idList?: string, desc?: string }) {
  const queryParams = new URLSearchParams({
    key,
    token,
    ...updates
  });

  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}?${queryParams.toString()}`,
    { method: "PUT" }
  );

  return res.json();
}

export async function getBoardCustomFields() {
  const longId = await getFullBoardId();
  const res = await fetch(`${BASE_URL}/boards/${longId}/customFields?key=${key}&token=${token}`);
  return res.json();
}

export async function updateCustomField(cardId: string, customFieldId: string, value: any, type: 'text' | 'number') {
  const body = type === 'text' ? { value: { text: String(value) } } : { value: { number: String(value) } };
  
  const res = await fetch(
    `https://api.trello.com/1/cards/${cardId}/customField/${customFieldId}/item?key=${key}&token=${token}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  return res.json();
}
