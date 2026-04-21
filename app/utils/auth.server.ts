import { redirect } from "react-router";
import { getSession } from "./session.server";

export async function requireLogin(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const username = session.get("username");

  if (!username) {
    throw redirect("/login");
  }

  return username;
}
