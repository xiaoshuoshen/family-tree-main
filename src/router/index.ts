import { createRouter, createWebHistory } from 'vue-router'
import FamilyWorkspace from '../pages/FamilyWorkspace.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: FamilyWorkspace,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
