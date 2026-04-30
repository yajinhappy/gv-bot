import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../client';

// 주요 도시별 시간대 정보
const CITY_TIMEZONES: Record<string, { timezone: string; offset: string; region: string }> = {
  '서울': { timezone: 'Asia/Seoul', offset: 'GMT+09:00', region: '대한민국' },
  '도쿄': { timezone: 'Asia/Tokyo', offset: 'GMT+09:00', region: '일본' },
  '베이징': { timezone: 'Asia/Shanghai', offset: 'GMT+08:00', region: '중국' },
  '상하이': { timezone: 'Asia/Shanghai', offset: 'GMT+08:00', region: '중국' },
  '방콕': { timezone: 'Asia/Bangkok', offset: 'GMT+07:00', region: '태국' },
  '싱가포르': { timezone: 'Asia/Singapore', offset: 'GMT+08:00', region: '싱가포르' },
  '뉴델리': { timezone: 'Asia/Kolkata', offset: 'GMT+05:30', region: '인도' },
  '두바이': { timezone: 'Asia/Dubai', offset: 'GMT+04:00', region: 'UAE' },
  '모스크바': { timezone: 'Europe/Moscow', offset: 'GMT+03:00', region: '러시아' },
  '이스탄불': { timezone: 'Europe/Istanbul', offset: 'GMT+03:00', region: '튀르키예' },
  '카이로': { timezone: 'Africa/Cairo', offset: 'GMT+02:00', region: '이집트' },
  '파리': { timezone: 'Europe/Paris', offset: 'GMT+01:00', region: '프랑스' },
  '베를린': { timezone: 'Europe/Berlin', offset: 'GMT+01:00', region: '독일' },
  '런던': { timezone: 'Europe/London', offset: 'GMT+00:00', region: '영국' },
  '상파울루': { timezone: 'America/Sao_Paulo', offset: 'GMT-03:00', region: '브라질' },
  '부에노스아이레스': { timezone: 'America/Argentina/Buenos_Aires', offset: 'GMT-03:00', region: '아르헨티나' },
  '뉴욕': { timezone: 'America/New_York', offset: 'GMT-05:00', region: '미국 동부' },
  '시카고': { timezone: 'America/Chicago', offset: 'GMT-06:00', region: '미국 중부' },
  '덴버': { timezone: 'America/Denver', offset: 'GMT-07:00', region: '미국 산악' },
  '로스앤젤레스': { timezone: 'America/Los_Angeles', offset: 'GMT-08:00', region: '미국 서부' },
  '시드니': { timezone: 'Australia/Sydney', offset: 'GMT+10:00', region: '호주' },
  '오클랜드': { timezone: 'Pacific/Auckland', offset: 'GMT+12:00', region: '뉴질랜드' },
  '하와이': { timezone: 'Pacific/Honolulu', offset: 'GMT-10:00', region: '미국 하와이' },
  // 영문 도시명 지원
  'seoul': { timezone: 'Asia/Seoul', offset: 'GMT+09:00', region: '대한민국' },
  'tokyo': { timezone: 'Asia/Tokyo', offset: 'GMT+09:00', region: '일본' },
  'new york': { timezone: 'America/New_York', offset: 'GMT-05:00', region: '미국 동부' },
  'london': { timezone: 'Europe/London', offset: 'GMT+00:00', region: '영국' },
  'paris': { timezone: 'Europe/Paris', offset: 'GMT+01:00', region: '프랑스' },
  'los angeles': { timezone: 'America/Los_Angeles', offset: 'GMT-08:00', region: '미국 서부' },
  'sydney': { timezone: 'Australia/Sydney', offset: 'GMT+10:00', region: '호주' },
  'sao paulo': { timezone: 'America/Sao_Paulo', offset: 'GMT-03:00', region: '브라질' },
  'singapore': { timezone: 'Asia/Singapore', offset: 'GMT+08:00', region: '싱가포르' },
  'dubai': { timezone: 'Asia/Dubai', offset: 'GMT+04:00', region: 'UAE' },
  'moscow': { timezone: 'Europe/Moscow', offset: 'GMT+03:00', region: '러시아' },
  'beijing': { timezone: 'Asia/Shanghai', offset: 'GMT+08:00', region: '중국' },
  'bangkok': { timezone: 'Asia/Bangkok', offset: 'GMT+07:00', region: '태국' },
};

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('도시')
    .setDescription('도시명으로 시간대를 확인합니다')
    .addStringOption(option =>
      option
        .setName('도시명')
        .setDescription('시간대를 확인할 도시 이름 (예: 서울, 뉴욕, 런던)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const cityName = interaction.options.getString('도시명', true).toLowerCase().trim();

    const cityInfo = CITY_TIMEZONES[cityName];

    if (!cityInfo) {
      const availableCities = Object.keys(CITY_TIMEZONES)
        .filter(key => !/^[a-z]/.test(key)) // 한글 도시만
        .join(', ');

      await interaction.reply({
        content: `❌ **${cityName}** 도시를 찾을 수 없습니다.\n\n📍 **지원 도시 목록:**\n${availableCities}`,
        ephemeral: true,
      });
      return;
    }

    // 해당 시간대의 현재 시각 계산
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: cityInfo.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const localTime = formatter.format(now);

    const embed = new EmbedBuilder()
      .setTitle(`🌍 ${cityName} 시간대 정보`)
      .setColor(0x5865F2)
      .addFields(
        { name: '🏙️ 지역', value: cityInfo.region, inline: true },
        { name: '⏰ 시간대', value: cityInfo.offset, inline: true },
        { name: '🕐 현재 시각', value: localTime, inline: true },
      )
      .setFooter({ text: `Timezone: ${cityInfo.timezone}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`tz_set_${cityInfo.offset}`)
        .setLabel('이 시간대로 설정')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

export default command;
