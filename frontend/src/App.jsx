import ClaimReward
from "./pages/ClaimReward";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";


// =====================================================
// PROTECTED ROUTE
// =====================================================

function ProtectedRoute({ children }) {

  const token =
    localStorage.getItem("token");


  console.log(
    "ProtectedRoute token exists:",
    !!token
  );


  if (!token) {

    return (
      <Navigate
        to="/login"
        replace
      />
    );

  }


  return children;
}


// =====================================================
// APP
// =====================================================

function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* ============================================
            ROOT
        ============================================ */}

        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />


        {/* ============================================
            LOGIN
        ============================================ */}

        <Route
          path="/login"
          element={
            <Login />
          }
        />


        {/* ============================================
            SIGNUP
        ============================================ */}

        <Route
          path="/signup"
          element={
            <Signup />
          }
        />


        {/* ============================================
            DASHBOARD
        ============================================ */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />


        {/* ============================================
            UNKNOWN ROUTE
        ============================================ */}

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
  path="/claim/:token"
  element={
    <ClaimReward />
  }
/>

      </Routes>

    </BrowserRouter>

  );

}


export default App;
