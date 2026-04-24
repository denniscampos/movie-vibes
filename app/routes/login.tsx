import { compare } from "bcryptjs";
import { Form, redirect, useNavigation } from "react-router";
import { Button, Field } from "~/components/mv";
import { users } from "~/config/users";
import { commitSession, getSession } from "~/utils/session.server";
import type { Route } from "./+types/login";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await getSession(request.headers.get("Cookie"));
  if (session.get("username")) {
    return redirect("/");
  }
  return null;
};

export const action = async ({ request }: Route.ActionArgs) => {
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

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-organic border-2 border-ink-line bg-card p-8 shadow-ink-lg">
        <div className="mb-7 text-center">
          <div className="mb-[6px] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            members only · est. 2025
          </div>
          <h1 className="m-0 font-hand-2 text-[40px] leading-none text-ink">
            Movie Vibes
          </h1>
          <p className="mt-2 font-hand text-[15px] text-ink-soft">
            What are we watching?
          </p>
        </div>

        <Form method="post" className="flex flex-col gap-4">
          <Field
            id="username"
            name="username"
            type="text"
            label="Username"
            autoComplete="username"
            autoFocus
          />
          <Field
            id="password"
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
          />

          {actionData?.error && (
            <p className="font-hand text-[13px] text-destructive">{actionData.error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="mt-2 w-full justify-center"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in →"}
          </Button>
        </Form>
      </div>
    </div>
  );
}
