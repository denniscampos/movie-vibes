import { redirect } from "react-router";
import { usernameCookie } from "./cookies";

export async function requireLogin(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  const userVisited = (await usernameCookie.parse(cookieHeader)) || false;

  if (!userVisited) {
    throw redirect("/login");
  }
}
