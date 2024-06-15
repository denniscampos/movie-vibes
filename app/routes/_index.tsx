import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { Movies, columns } from "~/components/Columns";
import { DataTable } from "~/components/DataTable";

export const meta: MetaFunction = () => {
  return [
    { title: "Movie Vibes" },
    { name: "description", content: "Vibe with yo friends." },
  ];
};

const items = ["dnbull", "Lumster", "mon-ster", "Shway", "shwaj"];

export const loader = async () => {
  async function getData(): Promise<Movies[]> {
    // Fetch data from your API here.
    return [
      {
        id: "1",
        movieName: "Dead Poets Society",
        year: 1989,
        category: "Robin Williams",
        selectedBy: "Bob Bobber",
      },
      {
        id: "2",
        movieName: "The Lion King",
        year: 1994,
        category: "Disney",
        selectedBy: "Bobby Boberson",
      },
      {
        id: "3",
        movieName: "The Matrix",
        year: 1999,
        category: "Sci-Fi",
        selectedBy: "bobbster of bobs",
      },
      {
        id: "4",
        movieName: "Forrest Gump",
        year: 1994,
        category: "Drama",
        selectedBy: "Bob hates bob",
      },
      {
        id: "5",
        movieName: "Good Will Hunting",
        year: 1997,
        category: "Robin Williams",
        selectedBy: "Bobin Billiams",
      },
      {
        id: "6",
        movieName: "Jurassic Park",
        year: 1993,
        category: "Adventure",
        selectedBy: "Bobrassic Bark",
      },
    ];
  }

  return json(await getData());
};

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const spin = () => {
    const randomIndex = Math.floor(Math.random() * items.length);
    setSelectedItem(items[randomIndex]);
  };

  return (
    <div>
      <h2>Movie Vibes</h2>

      <DataTable columns={columns} data={loaderData} />

      <div>
        <button onClick={spin}>Spin Picker</button>
        {selectedItem && <div>Selected: {selectedItem}</div>}
      </div>
    </div>
  );
}
