type ReadResult<Row> = {
  data: Row[] | null;
  error: { message: string } | null;
};

// Keep each page below the API's default 1,000-row response limit. A stable,
// unique ordering belongs to the query so offset pages cannot overlap.
export async function fetchAllRows<Row>(
  readPage: (from: number, to: number) => PromiseLike<ReadResult<Row>>,
): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const result = await readPage(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

// Bound .in filters as well as response sizes: thousands of IDs can exceed
// PostgREST's URL limit even when the resulting rows are paginated.
export async function fetchRowsByIds<Id, Row>(
  values: Id[],
  readBatch: (ids: Id[]) => Promise<Row[]>,
): Promise<Row[]> {
  const ids = [...new Set(values)];
  const rows: Row[] = [];
  for (let from = 0; from < ids.length; from += 200) {
    rows.push(...(await readBatch(ids.slice(from, from + 200))));
  }
  return rows;
}
