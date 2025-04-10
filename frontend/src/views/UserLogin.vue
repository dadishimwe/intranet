<template>
    <div class="login-container">
      <div class="login-wrapper">
        <!-- Login form card -->
        <div class="login-card">
          <!-- Logo and title -->
          <div class="login-header">
            <i class="pi pi-building logo-icon"></i>
            <h1 class="login-title">Corporate Intranet</h1>
            <p class="login-subtitle">Sign in to your account</p>
          </div>
          
          <!-- Error message -->
          <Message v-if="errorMessage" severity="error" :closable="false">
            {{ errorMessage }}
          </Message>
          
          <!-- Login form -->
          <form @submit.prevent="handleLogin" class="login-form">
            <div class="form-group">
              <label for="email">Email</label>
              <InputText 
                id="email" 
                v-model="email" 
                type="email" 
                class="w-full" 
                placeholder="Enter your email"
                :class="{ 'p-invalid': submitted && !email }"
                autocomplete="username"
                required
              />
              <small v-if="submitted && !email" class="p-error">Email is required</small>
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <Password 
                id="password" 
                v-model="password" 
                class="w-full" 
                placeholder="Enter your password"
                :feedback="false"
                toggleMask
                :class="{ 'p-invalid': submitted && !password }"
                autocomplete="current-password"
                required
              />
              <small v-if="submitted && !password" class="p-error">Password is required</small>
            </div>
            
            <div class="form-footer">
              <div class="remember-me">
                <Checkbox v-model="rememberMe" inputId="rememberMe" :binary="true" />
                <label for="rememberMe">Remember me</label>
              </div>
              
              <a href="#" class="forgot-password" @click.prevent="showForgotPassword">
                Forgot password?
              </a>
            </div>
            
            <Button 
              type="submit" 
              label="Sign In" 
              icon="pi pi-sign-in" 
              class="login-button" 
              :loading="loading" 
            />
          </form>
          
          <!-- System information -->
          <div class="system-info">
            <span>Raspberry Pi Intranet v1.0</span>
          </div>
        </div>
      </div>
      
      <!-- Forgot password dialog -->
      <Dialog 
        v-model:visible="forgotPasswordVisible" 
        header="Reset Password" 
        :modal="true"
        :closable="true"
        :style="{ width: '450px' }"
      >
        <div class="forgot-password-content">
          <p>Enter your email address and we'll send you instructions to reset your password.</p>
          
          <div class="form-group mt-4">
            <label for="resetEmail">Email Address</label>
            <InputText 
              id="resetEmail" 
              v-model="resetEmail" 
              type="email" 
              class="w-full" 
              placeholder="Enter your email"
              required
            />
          </div>
          
          <Message 
            v-if="resetMessage" 
            :severity="resetMessageType" 
            :closable="false"
            class="mt-4"
          >
            {{ resetMessage }}
          </Message>
        </div>
        
        <template #footer>
          <Button 
            label="Cancel" 
            icon="pi pi-times" 
            class="p-button-text" 
            @click="forgotPasswordVisible = false" 
          />
          <Button 
            label="Submit" 
            icon="pi pi-check" 
            @click="handleResetPassword" 
            :loading="resetLoading"
          />
        </template>
      </Dialog>
    </div>
  </template>
  
  <script>
  import { ref } from 'vue';
  import { useStore } from 'vuex';
  import { useRouter, useRoute } from 'vue-router';
  import InputText from 'primevue/inputtext';
  import Password from 'primevue/password';
  import Button from 'primevue/button';
  import Checkbox from 'primevue/checkbox';
  import Message from 'primevue/message';
  import Dialog from 'primevue/dialog';
  import api from '../services/api';
  
  export default {
    name: 'Login',
    components: {
      InputText,
      Password,
      Button,
      Checkbox,
      Message,
      Dialog
    },
    setup() {
      const store = useStore();
      const router = useRouter();
      const route = useRoute();
      
      // Login form
      const email = ref('');
      const password = ref('');
      const rememberMe = ref(false);
      const errorMessage = ref('');
      const submitted = ref(false);
      const loading = ref(false);
      
      // Password reset
      const forgotPasswordVisible = ref(false);
      const resetEmail = ref('');
      const resetMessage = ref('');
      const resetMessageType = ref('info');
      const resetLoading = ref(false);
      
      // Methods
      const handleLogin = async () => {
        submitted.value = true;
        
        // Validate form
        if (!email.value || !password.value) {
          return;
        }
        
        try {
          loading.value = true;
          errorMessage.value = '';
          
          const result = await store.dispatch('login', {
            email: email.value,
            password: password.value
          });
          
          if (result.success) {
            // Navigate to intended destination or home page
            const redirectPath = route.query.redirect || '/';
            router.push(redirectPath);
          } else {
            errorMessage.value = result.message || 'Login failed. Please check your credentials.';
          }
        } catch (error) {
          errorMessage.value = 'An error occurred. Please try again later.';
          console.error('Login error:', error);
        } finally {
          loading.value = false;
        }
      };
      
      const showForgotPassword = () => {
        resetEmail.value = email.value || '';
        resetMessage.value = '';
        forgotPasswordVisible.value = true;
      };
      
      const handleResetPassword = async () => {
        if (!resetEmail.value) {
          resetMessage.value = 'Please enter your email address';
          resetMessageType.value = 'error';
          return;
        }
        
        try {
          resetLoading.value = true;
          resetMessage.value = '';
          
          // Call password reset API
          await api.post('/auth/request-password-reset', {
            email: resetEmail.value
          });
          
          // Show success message regardless of whether the email exists
          resetMessage.value = 'If your email exists in our system, you will receive reset instructions shortly.';
          resetMessageType.value = 'success';
          
          // Auto-close dialog after 5 seconds
          setTimeout(() => {
            forgotPasswordVisible.value = false;
          }, 5000);
          
        } catch (error) {
          resetMessage.value = 'An error occurred. Please try again later.';
          resetMessageType.value = 'error';
          console.error('Password reset error:', error);
        } finally {
          resetLoading.value = false;
        }
      };
      
      return {
        email,
        password,
        rememberMe,
        errorMessage,
        submitted,
        loading,
        forgotPasswordVisible,
        resetEmail,
        resetMessage,
        resetMessageType,
        resetLoading,
        handleLogin,
        showForgotPassword,
        handleResetPassword
      };
    }
  };
  </script>
  
  <style scoped>
  .login-container {
    display: flex;
    min-height: 100vh;
    background-color: var(--surface-ground);
    overflow: auto;
  }
  
  .login-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 100vh;
    padding: 2rem;
  }
  
  .login-card {
    width: 100%;
    max-width: 450px;
    background-color: var(--surface-card);
    border-radius: 1rem;
    box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.1),
                0 1px 1px 0 rgba(0, 0, 0, 0.07),
                0 1px 3px 0 rgba(0, 0, 0, 0.06);
    padding: 2rem;
  }
  
  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  .logo-icon {
    font-size: 3rem;
    color: var(--primary-color);
    margin-bottom: 1rem;
  }
  
  .login-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
  }
  
  .login-subtitle {
    color: var(--text-color-secondary);
    margin-top: 0.5rem;
  }
  
  .login-form {
    display: flex;
    flex-direction: column;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  .form-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .remember-me {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .forgot-password {
    color: var(--primary-color);
    text-decoration: none;
    font-size: 0.875rem;
  }
  
  .login-button {
    width: 100%;
    margin-bottom: 1rem;
  }
  
  .system-info {
    text-align: center;
    margin-top: 2rem;
    color: var(--text-color-secondary);
    font-size: 0.875rem;
  }
  
  .forgot-password-content {
    margin-bottom: 1rem;
  }
  
  /* Make form inputs full width on PrimeVue components */
  :deep(.p-password),
  :deep(.p-inputtext) {
    width: 100%;
  }
  </style>