<script lang="ts"></script>

<div class="container">
  <slot />
</div>

<style>
  .container {
    width: 100%;
    height: 100%;
    margin-inline: auto;
    background-color: var(--white);
    padding-inline: 1.5rem;
  }

  @media screen and (min-width: 800px) {
    .container {
      width: 650px;
      height: unset;
      border-radius: 2rem;
      padding-inline: 3rem;
      padding-block-end: 3rem;
      box-shadow: var(--light-grayish-blue-1) 0px 7px 29px 0px;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  }
</style>
