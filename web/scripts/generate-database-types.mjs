import { PGlite } from "@electric-sql/pglite";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const migrationsDirectory = path.join(repositoryRoot, "supabase/migrations");
const outputPath = path.join(
  repositoryRoot,
  "web/src/types/database.generated.ts",
);

const database = new PGlite();

await database.exec("create role anon; create role authenticated;");

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const migrationFile of migrationFiles) {
  const migration = await readFile(
    path.join(migrationsDirectory, migrationFile),
    "utf8",
  );
  await database.exec(migration);
}

const { rows: columns } = await database.query(`
  select
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default,
    ordinal_position
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position
`);

const { rows: enumRows } = await database.query(`
  select
    type.typname as enum_name,
    enum.enumlabel as enum_value,
    enum.enumsortorder
  from pg_type as type
  join pg_enum as enum on type.oid = enum.enumtypid
  join pg_namespace as namespace on namespace.oid = type.typnamespace
  where namespace.nspname = 'public'
  order by type.typname, enum.enumsortorder
`);

const { rows: relationships } = await database.query(`
  select
    constraint_info.table_name,
    constraint_info.constraint_name,
    key_info.column_name,
    foreign_info.table_name as foreign_table_name,
    foreign_info.column_name as foreign_column_name
  from information_schema.table_constraints as constraint_info
  join information_schema.key_column_usage as key_info
    on constraint_info.constraint_name = key_info.constraint_name
    and constraint_info.constraint_schema = key_info.constraint_schema
  join information_schema.constraint_column_usage as foreign_info
    on foreign_info.constraint_name = constraint_info.constraint_name
    and foreign_info.constraint_schema = constraint_info.constraint_schema
  where
    constraint_info.constraint_type = 'FOREIGN KEY'
    and constraint_info.table_schema = 'public'
  order by constraint_info.table_name, constraint_info.constraint_name
`);

const enums = new Map();
for (const row of enumRows) {
  const values = enums.get(row.enum_name) ?? [];
  values.push(row.enum_value);
  enums.set(row.enum_name, values);
}

const tables = new Map();
for (const column of columns) {
  const tableColumns = tables.get(column.table_name) ?? [];
  tableColumns.push(column);
  tables.set(column.table_name, tableColumns);
}

function scalarType(column) {
  if (column.data_type === "ARRAY") {
    return column.udt_name === "_text" ? "string[]" : "Json[]";
  }

  if (column.data_type === "USER-DEFINED") {
    return `Database["public"]["Enums"]["${column.udt_name}"]`;
  }

  switch (column.data_type) {
    case "boolean":
      return "boolean";
    case "smallint":
    case "integer":
    case "bigint":
    case "numeric":
    case "real":
    case "double precision":
      return "number";
    case "json":
    case "jsonb":
      return "Json";
    default:
      return "string";
  }
}

function columnType(column) {
  const base = scalarType(column);
  return column.is_nullable === "YES" ? `${base} | null` : base;
}

function fieldsFor(tableColumns, mode) {
  return tableColumns
    .map((column) => {
      const optional =
        mode === "Update" ||
        (mode === "Insert" &&
          (column.is_nullable === "YES" || column.column_default !== null));
      return `          ${column.column_name}${optional ? "?" : ""}: ${columnType(column)};`;
    })
    .join("\n");
}

function relationshipsFor(tableName) {
  const tableRelationships = relationships.filter(
    (relationship) => relationship.table_name === tableName,
  );

  if (tableRelationships.length === 0) {
    return "[]";
  }

  return `[\n${tableRelationships
    .map(
      (relationship) => `          {
            foreignKeyName: "${relationship.constraint_name}";
            columns: ["${relationship.column_name}"];
            isOneToOne: false;
            referencedRelation: "${relationship.foreign_table_name}";
            referencedColumns: ["${relationship.foreign_column_name}"];
          }`,
    )
    .join(",\n")}\n        ]`;
}

const tableTypes = [...tables.entries()]
  .map(
    ([tableName, tableColumns]) => `      ${tableName}: {
        Row: {
${fieldsFor(tableColumns, "Row")}
        };
        Insert: {
${fieldsFor(tableColumns, "Insert")}
        };
        Update: {
${fieldsFor(tableColumns, "Update")}
        };
        Relationships: ${relationshipsFor(tableName)};
      };`,
  )
  .join("\n");

const enumTypes = [...enums.entries()]
  .map(
    ([enumName, values]) =>
      `      ${enumName}: ${values.map((value) => JSON.stringify(value)).join(" | ")};`,
  )
  .join("\n");

const output = `// Generated by scripts/generate-database-types.mjs.
// Source: versioned SQL migrations in supabase/migrations.
// Do not edit this file manually.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
${tableTypes}
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      set_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: {
${enumTypes}
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
await database.close();

console.log(
  `Generated ${path.relative(repositoryRoot, outputPath)} from ${migrationFiles.length} migration(s).`,
);
