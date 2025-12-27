import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, password } = body;

    // Валидация
    if (!name || (!email && !phone) || !password) {
      return NextResponse.json(
        { error: 'Заполните все обязательные поля' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен быть минимум 6 символов' },
        { status: 400 }
      );
    }

    // Проверяем существование пользователя
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email: email.toLowerCase() }] : []),
          ...(phone ? [{ phone: phone.replace(/\s/g, '') }] : []),
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким email или телефоном уже существует' },
        { status: 400 }
      );
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаём пользователя
    const user = await prisma.user.create({
      data: {
        name,
        email: email?.toLowerCase(),
        phone: phone?.replace(/\s/g, ''),
        passwordHash,
        role: 'customer',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Регистрация успешна',
      user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Ошибка регистрации' },
      { status: 500 }
    );
  }
}

