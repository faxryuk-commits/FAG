import { NextAuthOptions, getServerSession } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 дней
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  providers: [
    // Google OAuth (опционально)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // Вход по email/телефону + пароль
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        login: { label: 'Email или телефон', type: 'text' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) {
          throw new Error('Введите логин и пароль');
        }

        const login = credentials.login.trim();
        const isPhone = /^\+?\d{9,15}$/.test(login.replace(/\s/g, ''));

        // Ищем пользователя
        const user = await prisma.user.findFirst({
          where: isPhone
            ? { phone: login.replace(/\s/g, '') }
            : { email: login.toLowerCase() },
        });

        if (!user) {
          throw new Error('Пользователь не найден');
        }

        if (!user.passwordHash) {
          throw new Error('Используйте вход через Google');
        }

        if (!user.isActive) {
          throw new Error('Аккаунт заблокирован');
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Неверный пароль');
        }

        // Обновляем время последнего входа
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          image: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'customer';
        token.phone = (user as any).phone;
      }

      // Обновление сессии
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.phone = session.phone;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).phone = token.phone as string;
      }
      return session;
    },
  },
};

// Хелпер для получения сессии на сервере
export async function getSession() {
  return getServerSession(authOptions);
}

// Хелпер для проверки роли
export async function requireRole(roles: string[]) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Необходима авторизация');
  }
  if (!roles.includes((session.user as any).role)) {
    throw new Error('Недостаточно прав');
  }
  return session;
}

// Хелпер для проверки доступа мерчанта к ресторану
export async function checkMerchantAccess(userId: string, restaurantId: string) {
  const access = await prisma.merchantRestaurant.findUnique({
    where: {
      userId_restaurantId: { userId, restaurantId },
    },
  });
  return access?.isActive ?? false;
}

