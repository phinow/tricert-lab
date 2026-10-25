import { NextResponse } from 'next/server';
import {
  getStudyState,
  recordAttempt,
  saveArtifact,
  savePersonal,
  saveProfile,
  setProgress,
} from '@/lib/tricert-repository';

export async function GET() {
  try {
    return NextResponse.json(await getStudyState());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load study state.' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    switch (body.action) {
      case 'save-profile':
        await saveProfile(body);
        break;
      case 'save-personal':
        await savePersonal(body);
        break;
      case 'set-progress':
        await setProgress(body);
        break;
      case 'record-attempt':
        await recordAttempt(body);
        break;
      case 'save-artifact':
        await saveArtifact(body);
        break;
      default:
        return NextResponse.json({ error: 'Unsupported study action.' }, { status: 400 });
    }
    return NextResponse.json(await getStudyState());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save study state.' },
      { status: 400 },
    );
  }
}
