<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  active?: boolean
  danger?: boolean
  size?: 'small' | 'medium'
}>(), {
  active: false,
  danger: false,
  size: 'medium',
})
</script>

<template>
  <button
    class="icon-button"
    :class="[`icon-button--${size}`, { 'is-active': active, 'is-danger': danger }]"
    type="button"
    :aria-label="label"
    :title="label"
  >
    <slot />
  </button>
</template>
