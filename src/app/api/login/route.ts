import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { serialize } from 'cookie';

// Initialize the PostgreSQL connection pool
const pool = new Pool({
  connectionString: "postgres://akhtar11:9T0NMeQlomBAVtZ4_Q9RlA@grim-oribi-16146.8nj.gcp-europe-west1.cockroachlabs.cloud:26257/dev_db?sslmode=require"
});

// Secret key for JWT
const JWT_SECRET = "qwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm";

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    // Extract username and password from the request body
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ message: "Username and password are required" }, { status: 400 });
    }

    // Find the user in the database
    const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Check if the password matches using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ message: "Invalid username or password" }, { status: 401 });
    }

    // Generate a JWT token
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Serialize the cookie
    const cookie = serialize('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    // Respond with the token and set the cookie
    const response = NextResponse.json({ token: token, message: "Logged in successfully" });
    response.headers.set('Set-Cookie', cookie); // Set the cookie header here

    return response;

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  } finally {
    client.release();
  }
}
