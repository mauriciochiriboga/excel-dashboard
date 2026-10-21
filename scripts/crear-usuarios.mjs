import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";

const url = "https://cbhzgzulgarmzlbgbhgl.supabase.co";
const service = readFileSync(".service-role.tmp", "utf8").trim();
const sb = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

const admin = JSON.parse(process.env.ADMIN_JSON);
const nombres = ["Ana Torres","Luis Mera","Marta Salazar","Jorge Paredes","Sofía Andrade","Pedro Villacís","Lucía Cedeño","Diego Narváez","Carla Benítez","Andrés Molina","Valeria Zambrano","Esteban Rojas","Gabriela Ortiz","Ricardo Lara","Paula Jiménez","Fernando Guerra","Daniela Vera","Mateo Cárdenas","Camila Espinoza","Sebastián Pinto"];
const clave = () => "Ed-" + randomBytes(6).toString("base64url").replace(/[-_]/g, "x") + "9!";

async function crear(correo, password, nombre) {
  const { data, error } = await sb.auth.admin.createUser({ email: correo, password, email_confirm: true, user_metadata: { nombre } });
  if (error) {
    if (/already/i.test(error.message)) { console.log("ya existía:", correo); return null; }
    throw new Error(`${correo}: ${error.message}`);
  }
  return data.user.id;
}

const lineas = ["Usuarios creados para Excel Dashboard — https://excel-dashboard-beta.vercel.app/auth/entrar", `Generado: ${new Date().toISOString().slice(0,10)}`, "", "Nombre | Correo | Contraseña | Rol"];
const id = await crear(admin.correo, admin.clave, admin.nombre);
if (id) {
  const { error } = await sb.from("perfiles").update({ rol_global: "admin" }).eq("id", id);
  if (error) throw error;
}
console.log("administrador listo:", admin.correo);

let i = 1;
for (const n of nombres) {
  const [nom, ape] = n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(" ");
  const correo = `${nom}.${ape}@ejemplo.com`;
  const pw = clave();
  const uid = await crear(correo, pw, n);
  if (uid) lineas.push(`${String(i).padStart(2,"0")}. ${n} | ${correo} | ${pw} | usuario`);
  i++;
}
writeFileSync("usuarios-creados.txt", lineas.join("\r\n") + "\r\n", "utf8");
unlinkSync(".service-role.tmp");
console.log("archivo escrito con", lineas.length - 4, "usuarios");
