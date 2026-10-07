import emailjs from "emailjs-com";

export const sendReservationEmail = (data) => {
  return emailjs.send(
    "service_yy5hxht",
    "template_90d1i4b",
    data,
    "HqiyTp9Te6bVQvGpq"
  );
};
