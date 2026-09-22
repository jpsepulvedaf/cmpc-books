import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Demo seed for CMPC Libros.
// Idempotent: roles/authors/publishers/genres are upserted by their unique
// natural key (code/name), the admin user is created only if it does not
// exist, and books are upserted by ISBN.

// Prisma 7 requires a driver adapter at runtime; the URL comes from
// DATABASE_URL when set, otherwise it falls back to the local dev database.
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://cmpc:cmpc@localhost:5432/cmpc_books?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ADMIN_EMAIL = "admin@cmpc.libros";
const ADMIN_PASSWORD = "Admin123!";
const ADMIN_FULL_NAME = "Administrador del Sistema";

// Product content (roles, names, descriptions) is neutral Spanish on purpose.
const ROLES = [
  { code: "ADMIN", name: "Administrador", description: "Acceso total al sistema" },
  { code: "OPERADOR", name: "Operador", description: "Gestión del catálogo de libros" },
  { code: "CONSULTA", name: "Consulta", description: "Consulta de solo lectura del catálogo" },
];

const AUTHORS = ["Gabriel García Márquez", "Isabel Allende", "Mario Vargas Llosa"];

const PUBLISHERS = ["Editorial Austral", "Editorial Andina", "Editorial del Sur"];

const GENRES = ["Ficción", "Ciencia Ficción", "Misterio", "Historia"];

// { isbn, title, description, price, stock, author, publisher, genre }
const BOOKS = [
  { isbn: "978-3-16-148410-0", title: "El jardín de las mariposas", description: "Una novela sobre memoria y reconciliación familiar.", price: 19.9, stock: 12, author: AUTHORS[0], publisher: PUBLISHERS[0], genre: GENRES[0] },
  { isbn: "978-1-4028-9461-4", title: "Crónicas de la luna roja", description: "Tres generaciones unidas por un secreto lunar.", price: 22.5, stock: 0, author: AUTHORS[0], publisher: PUBLISHERS[1], genre: GENRES[0] },
  { isbn: "978-0-596-52068-2", title: "La casa de los susurros", description: "Un misterio en una casona del sur.", price: 17.8, stock: 8, author: AUTHORS[1], publisher: PUBLISHERS[0], genre: GENRES[2] },
  { isbn: "978-1-86100-373-0", title: "El último faro", description: "La historia de un guardián que nunca apagó su luz.", price: 21.4, stock: 5, author: AUTHORS[2], publisher: PUBLISHERS[2], genre: GENRES[0] },
  { isbn: "978-1-8435-6839-9", title: "Bitácora del viento", description: "Cartas de viaje escritas durante quince años.", price: 16.9, stock: 0, author: AUTHORS[1], publisher: PUBLISHERS[2], genre: GENRES[0] },
  { isbn: "978-0-545-90113-5", title: "El reloj de arena infinita", description: "Un artefacto que detiene el tiempo en cada vuelta.", price: 25.99, stock: 15, author: AUTHORS[0], publisher: PUBLISHERS[1], genre: GENRES[1] },
  { isbn: "978-0-596-00037-9", title: "Memorias de un bibliotecario", description: "Las historias escondidas detrás de una colección pública.", price: 28.0, stock: 7, author: AUTHORS[2], publisher: PUBLISHERS[0], genre: GENRES[3] },
  { isbn: "978-1-4303-0982-8", title: "La conspiración del mediodía", description: "Un robo imposible a plena luz del día.", price: 18.6, stock: 0, author: AUTHORS[1], publisher: PUBLISHERS[0], genre: GENRES[2] },
  { isbn: "978-0-13-149317-5", title: "El atlas de los sueños", description: "Un mapa que señala lugares que no existen.", price: 23.75, stock: 10, author: AUTHORS[2], publisher: PUBLISHERS[2], genre: GENRES[0] },
  { isbn: "978-0-452-28407-9", title: "Senderos de sal", description: "El éxodo de un pueblo costero contado por sus mujeres.", price: 20.3, stock: 9, author: AUTHORS[1], publisher: PUBLISHERS[1], genre: GENRES[3] },
  { isbn: "978-1-934871-37-3", title: "La máquina de lluvia", description: "Un invento que desata tormentas a voluntad.", price: 26.45, stock: 0, author: AUTHORS[0], publisher: PUBLISHERS[2], genre: GENRES[1] },
  { isbn: "978-0-7356-0865-1", title: "El código del archivero", description: "Un archivo milenario que nadie logró descifrar.", price: 19.95, stock: 6, author: AUTHORS[2], publisher: PUBLISHERS[1], genre: GENRES[2] },
  { isbn: "978-0-7685-4987-2", title: "Ciudad de papel", description: "Una urbe que se reconstruye cada amanecer.", price: 21.9, stock: 14, author: AUTHORS[1], publisher: PUBLISHERS[0], genre: GENRES[0] },
  { isbn: "978-1-56619-905-4", title: "Los días de ceniza", description: "Memoria de la erupción que cambió un valle entero.", price: 24.6, stock: 0, author: AUTHORS[0], publisher: PUBLISHERS[1], genre: GENRES[3] },
  { isbn: "978-0-1430-4189-7", title: "La frontera líquida", description: "Un río que separa dos países y dos formas de amar.", price: 22.2, stock: 11, author: AUTHORS[2], publisher: PUBLISHERS[2], genre: GENRES[1] },
];

async function main() {
  // ── Roles ────────────────────────────────────────────────────────────────
  const roleIds = new Map<string, number>();
  for (const role of ROLES) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: { code: role.code, name: role.name, description: role.description },
    });
    roleIds.set(role.code, saved.id);
  }

  // ── Admin user (idempotent) ──────────────────────────────────────────────
  const adminRoleId = roleIds.get("ADMIN")!;
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  let adminCreated = false;
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        fullName: ADMIN_FULL_NAME,
        isActive: true,
        roleId: adminRoleId,
      },
    });
    adminCreated = true;
  }

  // ── Authors ──────────────────────────────────────────────────────────────
  const authorIds = new Map<string, number>();
  for (const name of AUTHORS) {
    const saved = await prisma.author.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    authorIds.set(name, saved.id);
  }

  // ── Publishers ───────────────────────────────────────────────────────────
  const publisherIds = new Map<string, number>();
  for (const name of PUBLISHERS) {
    const saved = await prisma.publisher.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    publisherIds.set(name, saved.id);
  }

  // ── Genres ───────────────────────────────────────────────────────────────
  const genreIds = new Map<string, number>();
  for (const name of GENRES) {
    const saved = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    genreIds.set(name, saved.id);
  }

  // ── Books (idempotent by ISBN) ───────────────────────────────────────────
  let booksCreated = 0;
  for (const book of BOOKS) {
    const availability = book.stock > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
    await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: {
        title: book.title,
        description: book.description,
        price: book.price,
        stock: book.stock,
        availability,
        authorId: authorIds.get(book.author)!,
        publisherId: publisherIds.get(book.publisher)!,
        genreId: genreIds.get(book.genre)!,
      },
      create: {
        isbn: book.isbn,
        title: book.title,
        description: book.description,
        price: book.price,
        stock: book.stock,
        availability,
        imageUrl: null,
        authorId: authorIds.get(book.author)!,
        publisherId: publisherIds.get(book.publisher)!,
        genreId: genreIds.get(book.genre)!,
      },
    });
    booksCreated++;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const [roles, users, authors, publishers, genres, books] = await Promise.all([
    prisma.role.count(),
    prisma.user.count(),
    prisma.author.count(),
    prisma.publisher.count(),
    prisma.genre.count(),
    prisma.book.count(),
  ]);
  const outOfStock = await prisma.book.count({ where: { availability: "OUT_OF_STOCK" } });

  console.log("Seed completed successfully:");
  console.log(`  roles: ${roles} (ADMIN, OPERADOR, CONSULTA)`);
  console.log(`  users: ${users}${adminCreated ? " (admin created)" : " (admin already existed)"}`);
  console.log(`  authors: ${authors}`);
  console.log(`  publishers: ${publishers}`);
  console.log(`  genres: ${genres}`);
  console.log(`  books: ${books} (${booksCreated} upserted, ${outOfStock} OUT_OF_STOCK / ${books - outOfStock} IN_STOCK)`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });