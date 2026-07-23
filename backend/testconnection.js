import pool from "./db/database.js";

async function testConnection() {
  try {
    const connection = await pool.getConnection();

    console.log("✅ MySQL Connected Successfully");

    connection.release();
  } catch (error) {
    console.error("❌ Database Connection Failed");
    console.error(error.message);
  }
}

testConnection();