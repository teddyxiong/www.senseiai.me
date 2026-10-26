import nodemailer from 'nodemailer';
//import config from "@src/config/config.json";

export async function sendMail(name: string, email: string, message: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'teddyxiong2005@gmail.com', // Replace with your Gmail account
      pass: 'gfxr ginb zmjr ecqi' // Use Gmail app-specific password
    }
  });

    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: 'teddyxiong2005@gmail.com',
      subject: `New contact form submission - from ${name}`,
      html: `
        <h2>New contact form submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Sending email:', { name, email, message });
    return Promise.resolve();

}