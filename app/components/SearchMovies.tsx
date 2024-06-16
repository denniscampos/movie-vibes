import { Form } from "@remix-run/react";
import { Input } from "./ui/input";

export function SearchMovies() {
  return (
    <div className="mx-auto w-[500px] mb-5">
      <Form className="flex gap-3" method="POST">
        <Input
          id="searchMovies"
          name="searchMovies"
          type="text"
          placeholder="Search Movie"
        />
      </Form>
    </div>
  );
}
