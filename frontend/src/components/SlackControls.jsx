import {
  useState,
} from "react";

import client from "../api/client";


function SlackControls({
  connected,
  isAdmin,
  onSynced,
}) {

  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  if (!isAdmin) {

    return null;

  }


  async function connectSlack() {

    try {

      setError("");


      const response =
        await client.get(
          "/slack/connect"
        );


      window.location.href =
        response.data.url;


    } catch (error) {

      console.error(
        error
      );


      setError(

        error.response?.data?.error ||
        "Failed to connect Slack."

      );

    }

  }


  async function syncMembers() {

    try {

      setError("");

      setLoading(true);


      const response =
        await client.post(
          "/slack/sync-members"
        );


      onSynced?.(
        response.data
      );


    } catch (error) {

      console.error(
        error
      );


      setError(

        error.response?.data?.error ||
        "Failed to sync Slack members."

      );


    } finally {

      setLoading(false);

    }

  }


  return (

    <div className="slack-controls">

      {!connected ? (

        <button

          className="slack-connect-button"

          onClick={
            connectSlack
          }

        >

          Connect Slack

        </button>

      ) : (

        <button

          className="slack-sync-button"

          onClick={
            syncMembers
          }

          disabled={
            loading
          }

        >

          {loading
            ? "Syncing..."
            : "↻ Sync Slack Members"}

        </button>

      )}


      {error && (

        <div className="slack-control-error">

          {error}

        </div>

      )}

    </div>

  );

}


export default SlackControls;