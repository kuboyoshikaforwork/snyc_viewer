import {ChangeEventHandler} from 'react';

// Props定義
type Props = {
  theme: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

const CustomRangeSlider = (props: Props) => {
  return (
    <>
      <div>
        {props.theme} : {props.value}
      </div>

      <input
        min={props.min}
        max={props.max}
        step={props.step}
        type="range"
        value={props.value}
        onChange={props.onChange}
      />
    </>
  );
};
export default CustomRangeSlider;
