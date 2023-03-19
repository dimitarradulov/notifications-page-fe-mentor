<script lang="ts">
  import Notification from './Notifications/Notification.svelte';
  import NotificationsHeader from './Notifications/NotificationsHeader.svelte';
  import Container from './UI/Container.svelte';

  let notifications: any = [
    {
      activity: 'react',
      personName: 'Mark Webber',
      reactPost: 'My first tournament today!',
      unread: true,
    },
    {
      activity: 'follow',
      personName: 'Angela Gray',
      unread: true,
    },
    {
      activity: 'join-group',
      personName: 'Jacob Thompson',
      joinedGroup: 'Chess Club',
      unread: true,
    },
    {
      activity: 'private-message',
      personName: 'Rizky Hasanuddin',
      privateMessage:
        "Hello, thanks for setting up the Chess Club. I've been a member for a few weeks now and I'm already having lots of fun and improving my game.",
      unread: false,
    },
    {
      activity: 'comment',
      personName: 'Kimberly Smith',
      commentPicture: 'images/image-chess.webp',
      unread: false,
    },
    {
      activity: 'react',
      personName: 'Nathan Peterson',
      reactPost: '5 end-game strategies to increase your win rate',
      unread: false,
    },
    {
      activity: 'left-group',
      personName: 'Anna Kim',
      leftGroup: 'Chess Club',
      unread: false,
    },
  ];

  $: notificationsUnread = notifications.filter(
    (notification) => notification.unread
  ).length;

  function generateUniqueId() {
    let timestamp = Date.now().toString(36); // Convert current timestamp to base 36 string
    let randomNum = Math.random().toString(36).substr(2, 5); // Generate random number and convert to base 36 string
    return `${timestamp}-${randomNum}`;
  }

  function markNotificationsAsRead() {
    const areNotificationsUnread: boolean = notifications.some(
      (notification) => notification.unread
    );

    if (!areNotificationsUnread) {
      return;
    }

    notifications = notifications.map((notification) => {
      return { ...notification, unread: false };
    });
  }
</script>

<Container>
  <NotificationsHeader
    {notificationsUnread}
    on:click={markNotificationsAsRead}
  />

  <main>
    {#each notifications as notification (generateUniqueId())}
      <Notification {...notification} />
    {/each}
  </main>
</Container>

<style>
  /* .container {
    width: min(100% - 3rem, 650px);
    margin-inline: auto;
    background-color: var(--white);
    border-radius: 2rem;
    padding-inline: 3rem;
    padding-block-end: 3rem;
    box-shadow: var(--light-grayish-blue-1) 0px 7px 29px 0px;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  } */
</style>
