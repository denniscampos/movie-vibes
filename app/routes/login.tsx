import { compare } from "bcryptjs";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  Form,
  redirect,
  useActionData,
} from "react-router";
import { commitSession, getSession } from "~/utils/session.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { users } from "~/config/users";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getSession(request.headers.get("Cookie"));
  if (session.get("username")) {
    return redirect("/");
  }
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const username = formData.get("username")?.toString().toLowerCase();
  const password = formData.get("password")?.toString();

  const validUsername = users.map((u) => u.toLowerCase()).includes(String(username));

  if (!validUsername || !password) {
    return { error: "Invalid credentials, please try again" };
  }

  const passwordHash = process.env.AUTH_PASSWORD_HASH!;
  const validPassword = await compare(password, passwordHash);

  if (!validPassword) {
    return { error: "Invalid credentials, please try again" };
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("username", username!);

  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
};

export default function LoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Movie Vibes</h1>
          <p className="text-muted-foreground mt-2 text-sm">What are we watching?</p>
        </div>

        <Form method="post" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
            />
          </div>

          {actionData?.error && (
            <p className="text-sm text-destructive">{actionData.error}</p>
          )}

          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </Form>
      </div>
    </div>
  );
}
