<script lang="ts">
  import type { Activity } from '../models/notification.model';

  export let unread: boolean;
  export let activity: Activity;
  export let personName: string;
  export let reactPost: string = '';
  export let commentPicture: string = '';
  export let joinedGroup: string = '';
  export let leftGroup: string = '';
  export let privateMessage: string = '';

  function toKebabCase(str: string) {
    return str
      .toLowerCase() // Convert to lowercase
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '') // Remove any non-alphanumeric characters except hyphens
      .replace(/--+/g, '-') // Replace multiple consecutive hyphens with a single hyphen
      .replace(/^-+|-+$/g, ''); // Remove hyphens from the beginning or end of the string
  }
</script>

<article class="notification" class:notification--unread={unread}>
  <div class="notification__avatar">
    <img src="images/avatar-{toKebabCase(personName)}.webp" alt="avatar" />
  </div>

  <div class="notification__content">
    <p>
      <strong class="notification__person">{personName}</strong>

      {#if activity === 'react'}
        reacted to your recent post
        <a class="notification__react-post" href="#">{reactPost}</a>
      {:else if activity === 'comment'}
        commented on your picture
      {:else if activity === 'follow'}
        followed you
      {:else if activity === 'join-group'}
        has joined your group <a href="#" class="notification__group"
          >{joinedGroup}</a
        >
      {:else if activity === 'left-group'}
        left the group <a href="#" class="notification__group">{leftGroup}</a>
      {:else}
        sent you a private message
      {/if}

      {#if unread}
        <span class="notification__unread" />
      {/if}
    </p>

    <p class="notification__date">2 weeks ago</p>

    {#if privateMessage}
      <p class="notification__private-message">{privateMessage}</p>
    {/if}
  </div>

  {#if commentPicture}
    <div class="notification__comment-picture">
      <img src={commentPicture} alt="commented" />
    </div>
  {/if}
</article>

<style>
  .notification {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .notification:not(:last-child) {
    margin-block-end: 2rem;
  }

  .notification--unread {
    background-color: var(--very-light-grayish-blue);
    border-radius: var(--border-radius);
    border: 1px solid var(--light-grayish-blue-1);
    padding: 1.5rem;
  }

  .notification__avatar,
  .notification__comment-picture {
    flex-basis: 5rem;
    flex-shrink: 0;

    display: flex;
    align-items: center;
  }

  .notification__content {
    flex-grow: 1;
  }

  .notification__person {
    cursor: pointer;
    color: var(--very-dark-blue);
  }

  .notification__react-post {
    color: var(--dark-grayish-blue);
  }

  .notification__group {
    color: var(--blue);
  }

  .notification__unread {
    display: inline-block;
    border-radius: 50%;
    padding: 0.4rem;
    background-color: var(--red);
    margin-inline-start: 0.25rem;
  }

  .notification__private-message {
    margin-block-start: 1rem;
    padding: 1.5rem;
    border: 1px solid var(--light-grayish-blue-2);
    border-radius: var(--border-radius);
  }

  .notification__person,
  .notification__group,
  .notification__react-post {
    text-decoration: none;
    font-weight: 800;
  }

  .notification__person:hover,
  .notification__group:hover,
  .notification__react-post:hover {
    color: var(--blue);
  }
</style>
