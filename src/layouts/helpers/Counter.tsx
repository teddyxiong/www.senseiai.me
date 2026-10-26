import React from "react";
import CountUp from "react-countup";
import { useInView } from "react-intersection-observer";

const Counter = ({
  count,
  suffix,
  prefix,
  duration,
}: {
  count: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) => {
  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
  });

  return (
    <div ref={ref}>
      {inView && (
        <CountUp
          {...(duration && { duration })}
          prefix={prefix}
          className="js"
          end={+count}
          suffix={suffix}
        />
      )}
    </div>
  );
};

export default Counter;
