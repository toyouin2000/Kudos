import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import client from "../api/client";

import BalanceCard
  from "../components/BalanceCard";

import MembersTable
  from "../components/MembersTable";

import TransactionsTable
  from "../components/TransactionsTable";

import GiftCardModal
  from "../components/GiftCardModal";

import SlackControls
  from "../components/SlackControls";

import "../Dashboard.css";


function Dashboard() {

  const navigate =
    useNavigate();


  const [
    dashboard,
    setDashboard,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  const [
    selectedUser,
    setSelectedUser,
  ] = useState(null);


  const [
    success,
    setSuccess,
  ] = useState("");


  useEffect(() => {

    loadDashboard();

  }, []);


  async function loadDashboard() {

    try {

      setLoading(true);

      setError("");


      const response =
        await client.get(
          "/dashboard"
        );


      setDashboard(
        response.data
      );


    } catch (error) {

      console.error(
        error
      );


      if (
        error.response?.status ===
        401
      ) {

        localStorage.removeItem(
          "token"
        );

        navigate(
          "/login"
        );

        return;

      }


      setError(

        error.response?.data?.error ||
        "Failed to load dashboard."

      );

    } finally {

      setLoading(false);

    }

  }


  function logout() {

    localStorage.removeItem(
      "token"
    );

    navigate(
      "/login"
    );

  }


  function handleGiftCard(
    user
  ) {

    setSelectedUser(
      user
    );

  }


  function handleGiftCardSuccess(
    data
  ) {

    setSelectedUser(
      null
    );


    setSuccess(

      `Gift card redemption created.`

    );


    loadDashboard();


    setTimeout(
      () => {

        setSuccess("");

      },
      5000
    );

  }


  function handleSynced(
    result
  ) {

    setSuccess(

      `Slack sync complete. ${result.newUsers} new members added.`

    );


    loadDashboard();


    setTimeout(
      () => {

        setSuccess("");

      },
      5000
    );

  }


  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {

    return (

      <div className="dashboard-loading">

        Loading dashboard...

      </div>

    );

  }


  if (error) {

    return (

      <div className="dashboard-error">

        <h2>
          Something went wrong
        </h2>

        <p>
          {error}
        </p>

        <button
          onClick={
            loadDashboard
          }
          className="primary-button"
        >

          Try Again

        </button>

      </div>

    );

  }


  if (!dashboard) {

    return null;

  }


  const {
    organization,
    currentUser,
    users,
    transactions,
  } =
    dashboard;


  const isAdmin =
    currentUser.role ===
    "admin";


  return (

    <div className="dashboard">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <header className="dashboard-header">

        <div>

          <div className="brand">
            Kudos
          </div>

          <h1>
            {organization.name}
          </h1>

          <p>

            Welcome back,{" "}

            <strong>
              {currentUser.name}
            </strong>

          </p>

        </div>


        <div className="header-actions">

          <div
            className={
              organization.slackConnected
                ? "slack-status slack-connected"
                : "slack-status slack-disconnected"
            }
          >

            <span className="status-dot" />

            {organization.slackConnected
              ? "Slack Connected"
              : "Slack Not Connected"}

          </div>


          <SlackControls

            connected={
              organization.slackConnected
            }

            isAdmin={
              isAdmin
            }

            onSynced={
              handleSynced
            }

          />


          <button

            className="logout-button"

            onClick={
              logout
            }

          >

            Logout

          </button>

        </div>

      </header>


      {/* ================================================= */}
      {/* SUCCESS */}
      {/* ================================================= */}

      {success && (

        <div className="success-box">

          ✓ {success}

        </div>

      )}


      {/* ================================================= */}
      {/* BALANCES */}
      {/* ================================================= */}

      <section className="balance-grid">

        <BalanceCard

          title="My Reward Balance"

          value={
            currentUser.reward_balance
          }

          subtitle="Points available to give through Slack"

          accent

        />


        <BalanceCard

          title="My Received Balance"

          value={
            currentUser.received_balance
          }

          subtitle="Points earned from teammates"

        />

      </section>


      {/* ================================================= */}
      {/* MEMBERS */}
      {/* ================================================= */}

      <section className="dashboard-section">

        <div className="section-header">

          <div>

            <h2>
              Organization Members
            </h2>

            <p>

              Each employee receives
              100 reward points at the
              start of every month.

            </p>

          </div>


          <span className="member-count">

            {users.length}
            {" "}
            members

          </span>

        </div>


        <MembersTable

          users={
            users
          }

          isAdmin={
            isAdmin
          }

          onGiftCard={
            handleGiftCard
          }

        />

      </section>


      {/* ================================================= */}
      {/* TRANSACTIONS */}
      {/* ================================================= */}

      <section className="dashboard-section">

        <div className="section-header">

          <div>

            <h2>
              Transaction History
            </h2>

            <p>
              Kudos given through Slack.
            </p>

          </div>

        </div>


        <TransactionsTable

          transactions={
            transactions
          }

        />

      </section>


      {/* ================================================= */}
      {/* GIFT CARD MODAL */}
      {/* ================================================= */}

      {selectedUser && (

        <GiftCardModal

          user={
            selectedUser
          }

          onClose={() =>
            setSelectedUser(
              null
            )
          }

          onSuccess={
            handleGiftCardSuccess
          }

        />

      )}

    </div>

  );

}


export default Dashboard;