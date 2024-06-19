import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, json, redirect, useActionData } from "@remix-run/react";
import { usernameCookie } from "utils/cookies";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const users = ["dnbull", "Lumster", "mon-ster", "Shway", "shwaj"];
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookieHeader = request.headers.get("Cookie");

  const userVisited = (await usernameCookie.parse(cookieHeader)) || false;

  if (userVisited) {
    return redirect("/");
  }

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const username = formData.get("username")?.toString().toLowerCase();

  const normalizedUsername = users.map((user) => user.toLowerCase());

  if (!normalizedUsername.includes(String(username))) {
    return json({ error: "Invalid username, please try again" }, { status: 400 });
  }

  const cookie = await usernameCookie.serialize(true);
  return redirect("/", {
    headers: {
      "Set-Cookie": cookie,
    },
  });
};

export default function LoginPage() {
  const actionData = useActionData();

  return (
    <Form method="post">
      <Label htmlFor="username">Super Secret Login</Label>
      <Input id="username" name="username" type="text" />
      {/* @ts-expect-error cus ts  */}
      {actionData?.error && <p className="text-red-500">{actionData?.error}</p>}
      <Button type="submit">Login</Button>
    </Form>
  );
}
