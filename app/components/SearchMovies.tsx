import { Form } from "@remix-run/react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export function SearchMovies() {
  return (
    <div className="mx-auto w-[500px] mb-5">
      <Form className="flex gap-3" method="POST">
        <Input
          // id="searchMovies"
          name="searchMovies"
          type="text"
          placeholder="Search Movie"
        />
        <Button className="sr-only" type="submit" name="_action" value="search">
          Submit
        </Button>
      </Form>
    </div>
  );
}
