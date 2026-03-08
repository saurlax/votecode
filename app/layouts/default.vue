<script setup lang="ts">
const { user, clear } = useUserSession();
const mode = useState("mode", () => "preview");
</script>

<template>
  <UDashboardGroup storage="local">
    <UDashboardSidebar
      resizable
      :min-size="20"
      :default-size="30"
      :max-size="50"
    >
      <template #header>
        <UButton
          icon="i-lucide-vote"
          variant="ghost"
          class="w-full font-bold"
          to="/"
          label="votecode"
        />
      </template>
      <template #default>
        <SidebarChatMessages />
      </template>
      <template #footer>
        <SidebarChatPrompt />
      </template>
    </UDashboardSidebar>
    <UDashboardPanel :ui="{ body: 'p-0!' }">
      <template #header>
        <UDashboardNavbar>
          <template #title>
            <UTabs
              v-model="mode"
              :items="[
                { label: 'Preview', value: 'preview' },
                { label: 'Code', value: 'code' },
              ]"
              size="xs"
              :content="false"
            />
          </template>
          <template #right>
            <UColorModeButton />
            <UDropdownMenu
              v-if="user"
              :items="[
                { label: 'Logout', icon: 'i-lucide-log-out', onSelect: clear },
              ]"
            >
              <UButton
                color="neutral"
                variant="ghost"
                class="w-full"
                :label="user.name"
                :avatar="{ src: user.avatar_url }"
              />
            </UDropdownMenu>
            <UButton
              v-else
              color="neutral"
              variant="ghost"
              class="w-full"
              icon="i-lucide-log-in"
              label="Sign in with GitHub"
              to="/api/auth/github"
              external
            />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
