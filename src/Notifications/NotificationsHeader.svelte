<script lang="ts">
  export let notificationsUnread: number;
</script>

<header class="header">
  <h1 class="notifications">
    Notifications
    {#if notificationsUnread}
      <span class="notifications__count">{notificationsUnread}</span>
    {/if}
  </h1>
  <button class="mark-button" on:click>Mark all as read</button>
</header>

<style>
  .header {
    display: flex;
    justify-content: space-between;

    margin-block-end: 1.5rem;
  }

  .notifications {
    font-size: clamp(2rem, 3vw, 2.5rem);
    color: var(--very-dark-blue);
  }

  .notifications__count {
    margin-inline-start: 0.5rem;
    color: var(--white);
    background-color: var(--blue);
    padding-inline: 1.2rem;
    padding-block: 0.1rem;
    border-radius: var(--border-radius);
  }

  .mark-button,
  .mark-button:active {
    background-color: transparent;
  }

  .mark-button {
    color: var(--dark-grayish-blue);
    cursor: pointer;
    border: 0;
    margin: 0;
    padding: 0;
  }

  .mark-button:hover {
    color: var(--blue);
  }
</style>
