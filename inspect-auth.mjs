import { createDb } from "./packages/db/src/index.js";
import { createAuth } from "./packages/auth/src/index.js";

async function main() {
  const dbUrl = process.env.DATABASE_URL || "postgresql://postgres.loanzmtsltoppejrmfdj:CrackOnTech2026@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?schema=orbit_bot";
  const { prisma } = createDb(dbUrl);
  const auth = createAuth(prisma, {
    secret: "ba248cf030d765e4e265c92fcc80af80c1676798347ac29547b0b88d24b41d21",
    baseURL: "http://127.0.0.1:5173",
    webOrigin: "http://127.0.0.1:5173",
    signupsEnabled: "true",
    signupAllowlist: "",
  });

  const ctx = await auth.$context;
  const hash = await ctx.password.hash("Password12345678!");

  // Set password for adityaownseverything@gmail.com and orbit@forion.dev
  const users = await prisma.user.findMany({
    where: { OR: [{ email: "adityaownseverything@gmail.com" }, { email: "orbit@forion.dev" }] }
  });
  for (const user of users) {
    const acc = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" }
    });
    if (acc) {
      await prisma.account.update({
        where: { id: acc.id },
        data: { password: hash },
      });
    } else {
      await prisma.account.create({
        data: {
          id: "acc_" + user.id,
          accountId: user.id,
          userId: user.id,
          providerId: "credential",
          password: hash,
        }
      });
    }
    console.log("Password set successfully for", user.email);
  }

  // Now test signInEmail asResponse:
  const response = await auth.api.signInEmail({
    body: { email: "adityaownseverything@gmail.com", password: "Password12345678!" },
    asResponse: true,
  });
  console.log("Sign-in status:", response.status);
  console.log("Cookies:", response.headers.get("set-cookie"));
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
