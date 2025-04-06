import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  Form,
  redirect,
  useActionData,
} from "react-router";
import { usernameCookie } from "utils/cookies";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { users } from "~/config/users";

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
    return { error: "Invalid code, please try again" };
  }

  const cookie = await usernameCookie.serialize(true);
  return redirect("/", {
    headers: {
      "Set-Cookie": cookie,
    },
  });
};

export default function LoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <Form method="post">
      <Label htmlFor="username">Super Secret Login</Label>
      <Input id="username" name="username" type="text" />
      {actionData?.error && <p className="text-red-500">{actionData?.error}</p>}
      <Button type="submit">Login</Button>
    </Form>
  );
}
