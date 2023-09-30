export async function get_request(url: string): Promise<any> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
}

//sorry, gotta keep it consistent lol
export async function post_request(url: string, body: string | object): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    body: typeof body === 'object' ? JSON.stringify(body) : body,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
}