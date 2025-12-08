

// const bcrypt = require("bcryptjs");

// async function hashPassword(password) {
//   const salt = await bcrypt.genSalt(12);
//   return bcrypt.hash(password, salt);
// }

// // hashPassword("password123").then((res) => {
// //   console.log(res);
// // });

// const hash = "$2b$12$MrRkNQTTtGN4XsHGjvmY..1.DwRQDW8b5HL7tX63ZMfjlDGVTeO1O";

// bcrypt.compare("poopface", hash).then((res) => {
//   console.log(res);
// });

fetch("postgresql://backend_user:npg_CETNSbWKF0R5@ep-bitter-violet-afj2d6h9-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require").then((res) => {
  console.log(res);
})