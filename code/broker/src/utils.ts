import { X509Certificate } from "node:crypto";

export function getSubjectFromCert(cert: Buffer) {
  const x509 = new X509Certificate(cert);

  const subject: {
    CN: string | undefined;
    C: string | undefined;
    O: string | undefined;
    OU: string | undefined;
    L: string | undefined;
    ST: string | undefined;
    emailAddress: string | undefined;
  } = {
    CN: undefined,
    C: undefined,
    O: undefined,
    OU: undefined,
    L: undefined,
    ST: undefined,
    emailAddress: undefined,
  };

  const lines = x509.subject.split("\n");

  for (const line of lines) {
    const [key, value] = line.split("=");

    if (subject.hasOwnProperty(key)) {
      subject[key] = value;
    }
  }

  return subject;
}

export function getAltNamesFromCert(cert: Buffer | X509Certificate) {
  const x509 = Buffer.isBuffer(cert) ? new X509Certificate(cert) : cert;

  const subjectAltName = x509.subjectAltName ?? "";

  const names = subjectAltName.split(", ").map((name) => {
    const [key, value] = name.split(":");

    return { type: key, address: value };
  });

  return names;
}
