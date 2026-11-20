const VALUE_FLAGS = [
  "--email",
  "--name",
  "--phone",
  "--legal-name",
  "--trade-name",
  "--slug",
  "--primary-color",
  "--company-phone",
  "--company-email",
] as const;

type ValueFlag = (typeof VALUE_FLAGS)[number];

const REQUIRED_FLAGS: readonly ValueFlag[] = [
  "--email",
  "--name",
  "--legal-name",
  "--trade-name",
  "--slug",
  "--primary-color",
  "--company-phone",
  "--company-email",
];

export const MISSING_BOOTSTRAP_ARGS =
  "Bootstrap requires --email, --name, --legal-name, --trade-name, --slug, --primary-color, --company-phone and --company-email.";

export const INVALID_BOOTSTRAP_ARGS = "Bootstrap arguments are invalid.";

export const PASSWORD_ARGUMENT_REJECTED =
  "Bootstrap does not accept a password argument.";

export interface BootstrapArgs {
  confirm: boolean;
  email: string;
  name: string;
  phone?: string;
  legalName: string;
  tradeName: string;
  slug: string;
  primaryColor: string;
  companyPhone: string;
  companyEmail: string;
}

export type ParseResult =
  | { ok: true; value: BootstrapArgs }
  | { ok: false; message: string };

function isValueFlag(token: string): token is ValueFlag {
  return (VALUE_FLAGS as readonly string[]).includes(token);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

function isSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64;
}

function isBoundedText(value: string, max: number): boolean {
  return value.length > 0 && value.length <= max && !/[\r\n]/.test(value);
}

function isPhone(value: string): boolean {
  return /^[0-9+(). -]{1,40}$/.test(value) && /\d/.test(value);
}

function isColor(value: string): boolean {
  return /^[^\s]{1,32}$/.test(value);
}

export function parseBootstrapArgs(argv: readonly string[]): ParseResult {
  const values = new Map<ValueFlag, string>();
  let confirm = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--password" || token.startsWith("--password=")) {
      return { ok: false, message: PASSWORD_ARGUMENT_REJECTED };
    }
    if (token === "--confirm") {
      if (confirm) {
        return { ok: false, message: INVALID_BOOTSTRAP_ARGS };
      }
      confirm = true;
      continue;
    }
    if (!token.startsWith("--") || token.includes("=") || !isValueFlag(token)) {
      return { ok: false, message: INVALID_BOOTSTRAP_ARGS };
    }
    if (values.has(token)) {
      return { ok: false, message: INVALID_BOOTSTRAP_ARGS };
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      return { ok: false, message: INVALID_BOOTSTRAP_ARGS };
    }
    values.set(token, next);
    index += 1;
  }

  for (const flag of REQUIRED_FLAGS) {
    if ((values.get(flag) ?? "").trim() === "") {
      return { ok: false, message: MISSING_BOOTSTRAP_ARGS };
    }
  }

  const email = values.get("--email")?.trim() ?? "";
  const name = values.get("--name")?.trim() ?? "";
  const legalName = values.get("--legal-name")?.trim() ?? "";
  const tradeName = values.get("--trade-name")?.trim() ?? "";
  const slug = values.get("--slug")?.trim() ?? "";
  const primaryColor = values.get("--primary-color")?.trim() ?? "";
  const companyPhone = values.get("--company-phone")?.trim() ?? "";
  const companyEmail = values.get("--company-email")?.trim() ?? "";
  const phoneRaw = values.get("--phone");
  const phone = phoneRaw?.trim();

  if (
    !isEmail(email) ||
    !isEmail(companyEmail) ||
    !isBoundedText(name, 200) ||
    !isBoundedText(legalName, 200) ||
    !isBoundedText(tradeName, 200) ||
    !isSlug(slug) ||
    !isColor(primaryColor) ||
    !isPhone(companyPhone) ||
    (phoneRaw !== undefined && (phone === undefined || !isPhone(phone)))
  ) {
    return { ok: false, message: INVALID_BOOTSTRAP_ARGS };
  }

  return {
    ok: true,
    value: {
      confirm,
      email,
      name,
      ...(phone === undefined ? {} : { phone }),
      legalName,
      tradeName,
      slug,
      primaryColor,
      companyPhone,
      companyEmail,
    },
  };
}
