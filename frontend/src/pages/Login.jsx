
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import client from "../api/client";


function Login() {

  const navigate =
    useNavigate();


  const [form, setForm] =
    useState({
      email: "",
      password: "",
    });


  const [error, setError] =
    useState("");


  const [loading, setLoading] =
    useState(false);


  // =====================================================
  // HANDLE INPUT
  // =====================================================

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    });

  };


  // =====================================================
  // LOGIN
  // =====================================================

  const handleSubmit =
    async (e) => {

      e.preventDefault();

      setError("");
      setLoading(true);


      try {

        // ===============================================
        // API LOGIN
        // ===============================================

        const response =
          await client.post(
            "/auth/login",
            {
              email:
                form.email.trim(),

              password:
                form.password,
            }
          );


        const data =
          response.data;


        console.log(
          "LOGIN RESPONSE:",
          data
        );


        // ===============================================
        // VALIDATE RESPONSE
        // ===============================================

        if (!data.token) {

          throw new Error(
            "Login succeeded but no authentication token was returned."
          );

        }


        // ===============================================
        // STORE TOKEN
        // ===============================================

        localStorage.setItem(
          "token",
          data.token
        );


        // ===============================================
        // STORE USER
        // ===============================================

        if (data.user) {

          localStorage.setItem(
            "user",
            JSON.stringify(
              data.user
            )
          );

        }


        // ===============================================
        // STORE ORGANIZATION
        // ===============================================

        if (
          data.organizationId
        ) {

          localStorage.setItem(
            "organizationId",
            data.organizationId
          );

        }


        console.log(
          "AUTH DATA STORED:",
          {
            token:
              !!localStorage.getItem(
                "token"
              ),

            user:
              localStorage.getItem(
                "user"
              ),

            organizationId:
              localStorage.getItem(
                "organizationId"
              ),
          }
        );


        // ===============================================
        // REDIRECT TO DASHBOARD
        // ===============================================

        navigate(
          "/dashboard",
          {
            replace: true,
          }
        );


      } catch (err) {

        console.error(
          "Login error:",
          err
        );


        setError(
          err.response?.data?.error ||
          err.message ||
          "Invalid credentials"
        );


      } finally {

        setLoading(false);

      }

    };


  // =====================================================
  // UI
  // =====================================================

  return (

    <div className="auth-container">

      <div className="auth-card">

        <h1>
          Welcome back
        </h1>


        <p className="subtitle">
          Login to your Kudos account.
        </p>


        {error && (

          <div className="error">

            {error}

          </div>

        )}


        <form
          onSubmit={
            handleSubmit
          }
        >

          <input

            name="email"

            type="email"

            placeholder="Work email"

            value={
              form.email
            }

            onChange={
              handleChange
            }

            autoComplete="email"

            required

          />


          <input

            name="password"

            type="password"

            placeholder="Password"

            value={
              form.password
            }

            onChange={
              handleChange
            }

            autoComplete="current-password"

            required

          />


          <button

            type="submit"

            disabled={
              loading
            }

          >

            {loading
              ? "Logging in..."
              : "Login"}

          </button>

        </form>


        <p>

          Don't have an account?{" "}

          <Link to="/signup">

            Create one

          </Link>

        </p>

      </div>

    </div>

  );

}


export default Login;
