import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

import { Event } from "@/database";
import connectDB from "@/lib/mongodb";

/**
 * Create a new event from multipart form data and upload its image to Cloudinary.
 *
 * Validates incoming form data, requires an `image` file, parses `tags` and `agenda`, saves the image externally,
 * and inserts the resulting event document into the database.
 *
 * @returns A NextResponse containing JSON:
 * - Success (201): `{ message: 'Event created successfully', event }` with the created event document.
 * - Client error (400): `{ message }` describing the validation issue (e.g., missing image or invalid JSON).
 * - Server error (500): `{ message: 'Event Creationn Failed', error }` with an error string when an unexpected failure occurs.
 */
export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const formData = await req.formData();

        let event;

        try {
            event = Object.fromEntries(formData.entries());
        } catch (e) {
            return NextResponse.json({ message: 'Invalid JSON data format' }, { status: 400 })
        }

        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json({ message: 'Image file is required' }, { status: 400 });
        }

        let tags = JSON.parse(formData.get("tags") as string);
        let agenda = JSON.parse(formData.get("agenda") as string);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ resource_type: 'image', folder: 'DevEvent' }, (error, results) => {
                if (error) return reject(error);
                resolve(results);
            }).end(buffer);
        });

        event.image = (uploadResult as { secure_url: string }).secure_url;

        const createdEvent = await Event.create({
            ...event,
            tags,
            agenda
        });

        return NextResponse.json({ message: 'Event created successfully', event: createdEvent }, { status: 201 })
    } catch (e) {
        console.log(e);
        return NextResponse.json({ message: 'Event Creationn Failed', error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });

    }
}

/**
 * Handle GET requests to retrieve all events sorted by newest first.
 *
 * @returns A NextResponse containing `{ message, events }` with status 200 on success; on failure, a NextResponse containing `{ message, error }` with status 500.
 */
export async function GET(req: NextRequest) {
    try {
        await connectDB();

        const events = await Event.find().sort({ createdAt: -1 });

        return NextResponse.json({ message: 'Events fetched successfully', events }, { status: 200 });
    } catch (e) {
        console.log(e);
        return NextResponse.json({ message: 'Event Fetching Failed', error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
    }
}