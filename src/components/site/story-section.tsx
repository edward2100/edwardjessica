import Image from "next/image";
import { text } from "@/lib/i18n";
import type { Language, LocalizedString } from "@/lib/types";
import { weddingContent } from "@/lib/wedding-content";

type StorySpeaker = "him" | "her";

const storyMessages: Array<{
  speaker: StorySpeaker;
  body: LocalizedString;
}> = [
  {
    speaker: "him",
    body: {
      en: "2011 — It was textbook collection day, a few weeks before secondary school officially started. I was the new kid — just trying to survive walking into a room full of strangers.\n\nThen she walked in. She grabbed her books and left almost as quickly as she came, completely unaware that she had just become the most important person in my life.",
      id: "2011 — Hari itu adalah hari pengambilan buku, beberapa minggu sebelum sekolah resmi dimulai. Aku adalah anak baru — hanya berusaha bertahan saat masuk ke ruangan penuh orang asing.\n\nLalu dia masuk. Dia mengambil bukunya dan pergi hampir secepat dia datang, tanpa menyadari bahwa saat itu dia baru saja menjadi orang paling penting dalam hidupku."
    }
  },
  {
    speaker: "her",
    body: {
      en: "What I do remember is the first day of school — a quiet boy placed just beside my row, close enough to notice, not close enough to ignore. He didn't say much. He didn't have to.\n\nI noticed he kept staring at me in class. Not in a creepy way — more like he had something to say and kept losing his nerve at the last second. So I did the only logical thing. I started talking to him first.",
      id: "Yang aku ingat adalah hari pertama sekolah — seorang anak laki-laki pendiam duduk tepat di samping barisku, cukup dekat untuk diperhatikan, terlalu dekat untuk diabaikan. Dia tidak banyak bicara. Dia memang tidak perlu.\n\nAku sadar dia sering menatapku di kelas. Bukan dengan cara yang aneh — lebih seperti dia punya sesuatu untuk dikatakan, tapi selalu kehilangan keberanian di detik terakhir. Jadi aku melakukan hal yang paling masuk akal. Aku mulai mengajaknya bicara duluan."
    }
  },
  {
    speaker: "him",
    body: {
      en: "I wasn't staring — i was manifesting. I just didn't know how to actually talk to her yet. When she finally talked to me, I was overjoyed — every small interaction meant a lot to me. I looked forward to every single day of school.",
      id: "Aku bukan menatap — aku sedang manifesting. Aku hanya belum tahu cara benar-benar berbicara dengannya. Saat akhirnya dia bicara denganku, aku sangat bahagia — setiap interaksi kecil berarti banyak untukku. Aku menantikan setiap hari sekolah."
    }
  },
  {
    speaker: "her",
    body: {
      en: "What started as random little conversations slowly turned into years of friendship, and somewhere along the way, I fell for his sweet, shy, slightly mischievous charm.",
      id: "Yang awalnya hanya obrolan kecil perlahan berubah menjadi persahabatan bertahun-tahun, dan tanpa terasa aku jatuh hati pada pesonanya yang manis, pemalu, dan sedikit jahil."
    }
  },
  {
    speaker: "him",
    body: {
      en: "I asked her out in 2014… and well, the rest is history.",
      id: "Aku mengajaknya berpacaran pada tahun 2014… dan ya, sisanya menjadi sejarah."
    }
  }
];

const storyLabels: Record<StorySpeaker, LocalizedString> = {
  him: { en: "E", id: "E" },
  her: { en: "J", id: "J" }
};

export function StorySection({
  imageUrl = weddingContent.storyImageUrl,
  language
}: {
  imageUrl?: string;
  language: Language;
}) {
  return (
    <section className="section">
      <div className="container story-shell">
        <figure className="story-photo">
          <Image
            src={imageUrl}
            alt="Edward and Jessica in a green mountain landscape"
            fill
            sizes="(max-width: 860px) 100vw, 1120px"
          />
        </figure>

        <div className="story-intro">
          <p className="eyebrow">{language === "id" ? "Kisah Kami" : "Our Story"}</p>
          <h2 className="title serif">{language === "id" ? "Awal Cerita Kami" : "How it all started"}</h2>
        </div>

        <div className="story-dialogue">
          {storyMessages.map((message, index) => (
            <article className={`story-message ${message.speaker}`} key={`${message.speaker}-${index}`}>
              <p className="story-speaker">{text(storyLabels[message.speaker], language)}</p>
              {text(message.body, language)
                .split("\n\n")
                .map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
